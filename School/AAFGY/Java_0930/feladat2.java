import java.util.Scanner;
public class feladat2{
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Add meg a neved: ");
        String nev = sc.next();
        System.out.print("Add meg a korod: ");
        int kor = sc.nextInt();
        System.out.print("Add meg a magasságod: ");
        double magassag = sc.nextDouble();
        System.out.print("Add meg a testsúlyod: ");
        double suly = sc.nextDouble();
        System.out.print("Add meg a szem színed: ");
        String szszin = sc.next();
        System.out.print("Add meg a hajszíned: ");
        String hszin = sc.next();

        System.out.println("Neved: "+nev);
        System.out.println("Korod: "+kor);
        System.out.println("Magasságod: "+magassag);
        System.out.println("Test súlyod: "+suly);
        System.out.println("Szem szined: "+szszin);
        System.out.println("Haj színed: "+hszin);
    }
}